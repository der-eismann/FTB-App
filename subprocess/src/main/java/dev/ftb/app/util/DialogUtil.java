package dev.ftb.app.util;

import dev.ftb.app.api.WebSocketHandler;
import dev.ftb.app.api.data.other.CloseModalData;
import dev.ftb.app.api.data.other.OpenModalData;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class DialogUtil {

    public static boolean confirmDialog(String title, String body) {
        return confirmDialog(title, "Yes", "No", body);
    }

    public static boolean confirmDialog(String title, String confirmText, String denyText, String body) {
        AtomicBoolean result = new AtomicBoolean();

        OpenModalData.openModal(title, body, List.of(
                new OpenModalData.ModalButton(confirmText, "success", () -> {
                    result.set(true);
                    synchronized (result) {
                        WebSocketHandler.sendMessage(new CloseModalData());
                        result.notify();
                    }
                }),
                new OpenModalData.ModalButton(denyText, "danger", () -> {
                    result.set(false);
                    synchronized (result) {
                        WebSocketHandler.sendMessage(new CloseModalData());
                        result.notify();
                    }
                })
        ));

        try {
            synchronized (result) {
                result.wait();
            }
        } catch (InterruptedException ignored) {
        }

        return result.get();
    }

    public static ConfirmationState confirmOrIgnore(String title, String confirmText, String denyText, String ignoreText, String body) {
        // Atomic of the ConfirmationState
        AtomicInteger result = new AtomicInteger();

        OpenModalData.openModal(title, body, List.of(
            new OpenModalData.ModalButton(confirmText, "success", () -> {
                result.set(ConfirmationState.CONFIRM.ordinal());
                synchronized (result) {
                    WebSocketHandler.sendMessage(new CloseModalData());
                    result.notify();
                }
            }),
            new OpenModalData.ModalButton(ignoreText, "info", () -> {
                result.set(ConfirmationState.IGNORE.ordinal());
                synchronized (result) {
                    WebSocketHandler.sendMessage(new CloseModalData());
                    result.notify();
                }
            }),
            new OpenModalData.ModalButton(denyText, "danger", () -> {
                result.set(ConfirmationState.DENY.ordinal());
                synchronized (result) {
                    WebSocketHandler.sendMessage(new CloseModalData());
                    result.notify();
                }
            })
        ));

        try {
            synchronized (result) {
                result.wait();
            }
        } catch (InterruptedException ignored) {
        }

        var state = ConfirmationState.values();
        return state[result.get()];
    }

    public static void okDialog(String title, String body) {
        Object lock = new Object();

        OpenModalData.openModal(title, body, List.of(
                new OpenModalData.ModalButton("Ok", "success", () -> {
                    synchronized (lock) {
                        WebSocketHandler.sendMessage(new CloseModalData());
                        lock.notify();
                    }
                })
        ));

        try {
            synchronized (lock) {
                lock.wait();
            }
        } catch (InterruptedException ignored) {
        }
    }
    
    public enum ConfirmationState {
        CONFIRM,
        DENY,
        IGNORE
    }
}
