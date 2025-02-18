package dev.ftb.app.api.handlers.other;

import com.google.gson.Gson;
import dev.ftb.app.Constants;
import dev.ftb.app.api.WebSocketHandler;
import dev.ftb.app.api.data.BaseData;
import dev.ftb.app.api.handlers.IMessageHandler;
import dev.ftb.app.storage.UserApiCredentials;
import dev.ftb.app.util.ModpacksChUtils;
import org.jetbrains.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;

public class AppInitHandler implements IMessageHandler<AppInitHandler.Data> {
    private static final Logger LOGGER = LoggerFactory.getLogger(AppInitHandler.class);
    
    @Override
    public void handle(Data data) {
        boolean success = true;
        Reply.Builder reply = Reply.builder(data);
        
        UserApiCredentials userApiCredentials = this.loadUserApiCredentials();
        if (userApiCredentials != null) {
            ModpacksChUtils.API_TOKEN = userApiCredentials.apiSecret();
            ModpacksChUtils.USER_PROVIDED_CREDENTIALS = userApiCredentials;
            reply.setUserApiCredentials(userApiCredentials);
        }
        
        reply.setSuccess(success);
        WebSocketHandler.sendMessage(reply.build());
    }

    private UserApiCredentials loadUserApiCredentials() {
        if (Files.notExists(Constants.USER_PROVIDED_API_CREDENTIALS_FILE)) {
            return null;
        }
        
        try {
            return new Gson().fromJson(Files.readString(Constants.USER_PROVIDED_API_CREDENTIALS_FILE), UserApiCredentials.class);
        } catch (Exception e) {
            LOGGER.error("Failed to load user provided API credentials", e);
            return null;
        }
    }
    
    public static class Data extends BaseData {}
    
    public static class Reply extends Data {
        boolean success = false;
        String errorMessage = "";
        @Nullable UserApiCredentials apiCredentials;
        
        private Reply(Data data) {
            super();
            this.requestId = data.requestId;
            this.type = "appInitReply";
        }
        
        public static Builder builder(Data data) {
            return new Builder(data);
        }
        
        public static class Builder {
            private final Reply reply;
            
            private Builder(Data data) {
                reply = new Reply(data);
            }
            
            
            public Builder setSuccess(boolean success) {
                reply.success = success;
                return this;
            }
            
            public Builder setErrorMessage(String errorMessage) {
                reply.errorMessage = errorMessage;
                return this;
            }
            
            public Builder setUserApiCredentials(UserApiCredentials userApiCredentials) {
                reply.apiCredentials = userApiCredentials;
                return this;
            }
            
            public Reply build() {
                return reply;
            }
        }
    }
}
