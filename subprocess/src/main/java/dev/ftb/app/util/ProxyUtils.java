package dev.ftb.app.util;

import dev.ftb.app.Constants;
import dev.ftb.app.storage.CredentialStorage;
import dev.ftb.app.storage.settings.Settings;
import okhttp3.OkHttpClient;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.jetbrains.annotations.Nullable;

import java.io.IOException;
import java.net.*;
import java.util.List;
import java.util.Objects;

public class ProxyUtils {

    private static final Logger LOGGER = LogManager.getLogger();

    @Nullable
    private static final ProxySelector DEFAULT_SELECTOR = ProxySelector.getDefault();
    @Nullable
    private static final Authenticator DEFAULT_AUTH = Authenticator.getDefault();

    // Currently active proxy settings
    @Nullable
    private static String proxyType;
    @Nullable
    private static String proxyHost;
    @Nullable
    private static int proxyPort;
    @Nullable
    private static String proxyUser;
    @Nullable
    private static String proxyPassword;

    public static void loadProxy() {
        String settingsProxyType = Settings.getSettings().proxy().type();
        String settingsProxyHost = Settings.getSettings().proxy().host();
        int settingsProxyPort = Settings.getSettings().proxy().port();
        String settingsProxyUser = Settings.getSettings().proxy().username();
        
        // TODO: Remove: Migration, won't be needed for much longer
        if (!Settings.getSettings().proxy().password().isEmpty()) {
            // Move it to the credential storage.
            CredentialStorage.getInstance().set("proxyPassword", Settings.getSettings().proxy().password());
            Settings.getSettings().proxy().setPassword("");
            Settings.saveSettings();
        }
        
        String settingsProxyPassword = CredentialStorage.getInstance().get("proxyPassword");
        boolean requiresReset;
        requiresReset = !Objects.equals(proxyType, settingsProxyType);
        requiresReset |= !Objects.equals(proxyHost, settingsProxyHost);
        requiresReset |= !Objects.equals(proxyPort, settingsProxyPort);
        requiresReset |= !Objects.equals(proxyUser, settingsProxyUser);
        requiresReset |= !Objects.equals(proxyPassword, settingsProxyPassword);

        if (requiresReset) {
            proxyType = settingsProxyType;
            proxyHost = settingsProxyHost;
            proxyPort = settingsProxyPort;
            proxyUser = settingsProxyUser;
            proxyPassword = settingsProxyPassword;
            boolean hasAuth = StringUtils.isNotEmpty(proxyUser) && StringUtils.isNotEmpty(proxyPassword);
            LOGGER.info("Loading proxy configuration. {} {} {}, {} Authentication.", proxyType, proxyHost, proxyPort, hasAuth ? "With" : "Without");
            ProxyWithAuth proxy;
            try {
                proxy = loadProxy(proxyType, proxyHost, proxyPort, proxyUser, proxyPassword);
            } catch (Throwable ex) {
                LOGGER.warn("Failed to load proxy settings.", ex);
                proxy = null;
            }
            injectProxy(proxy);
            // Refresh http client to reset the connection pools.
            Constants.refreshHttpClient();
        }
    }

    @Nullable
    private static ProxyWithAuth loadProxy(String type, String host, int port, String username, String password) {
        if ("none".equals(type)) return null;

        if (StringUtils.isEmpty(type) || StringUtils.isEmpty(host) || port == -1) {
            return null;
        }

        Proxy.Type proxyType = switch (type) {
            case "http" -> Proxy.Type.HTTP;
            case "socks", "socks5" -> Proxy.Type.SOCKS;
            default -> throw new IllegalArgumentException("Unknown proxy type '" + type + "'. Expected one of 'http', or 'socks5'.");
        };
        PasswordAuthentication auth = null;
        if (!StringUtils.isEmpty(username) && !StringUtils.isEmpty(password)) {
            auth = new PasswordAuthentication(username, password.toCharArray());
        }
        return new ProxyWithAuth(proxyType, host, port, auth);
    }

    public static void inject(OkHttpClient.Builder builder) {
        // Set the ProxySelector used by OkHttpClient to dynamically query ProxySelector.getDefault.
        // @formatter:off
        builder.proxySelector(new ProxySelector() {
            @Override public List<Proxy> select(URI uri) { return ProxySelector.getDefault().select(uri); }
            @Override public void connectFailed(URI uri, SocketAddress sa, IOException ioe) { ProxySelector.getDefault().connectFailed(uri, sa, ioe); }
        });
        // @formatter:on
        // Use Java's builtin Authenticator.
        builder.proxyAuthenticator(okhttp3.Authenticator.JAVA_NET_AUTHENTICATOR);
    }

    public static void injectProxy(@Nullable ProxyWithAuth proxy) {
        if (proxy == null) {
            // Reset the ProxySelector and Authenticator back to the original defaults.
            ProxySelector.setDefault(DEFAULT_SELECTOR);
            Authenticator.setDefault(DEFAULT_AUTH);
            return;
        }

        // ProxySelector always selects our specified proxy.
        ProxySelector.setDefault(new ProxySelector() {
            @Override
            public List<Proxy> select(URI uri) {
                return List.of(proxy);
            }

            @Override
            public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
            }
        });

        // Authenticator uses our specified proxy's auth.
        Authenticator.setDefault(new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return proxy.auth;
            }
        });
    }
}
