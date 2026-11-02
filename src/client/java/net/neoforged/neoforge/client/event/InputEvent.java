package net.neoforged.neoforge.client.event;

import net.neoforged.bus.api.Event;
import net.neoforged.bus.api.ICancellableEvent;

public abstract class InputEvent extends Event {
    public static class MouseScrollingEvent extends InputEvent implements ICancellableEvent {
        private final double scrollDeltaX;
        private final double scrollDeltaY;

        public MouseScrollingEvent(double scrollDeltaX, double scrollDeltaY) {
            this.scrollDeltaX = scrollDeltaX;
            this.scrollDeltaY = scrollDeltaY;
        }

        public double getScrollDeltaX() {
            return scrollDeltaX;
        }

        public double getScrollDeltaY() {
            return scrollDeltaY;
        }
    }

    public static class Key extends InputEvent {
        private final int key;
        private final int scanCode;
        private final int action;
        private final int modifiers;

        public Key(int key, int scanCode, int action, int modifiers) {
            this.key = key;
            this.scanCode = scanCode;
            this.action = action;
            this.modifiers = modifiers;
        }

        public int getKey() {
            return key;
        }

        public int getScanCode() {
            return scanCode;
        }

        public int getAction() {
            return action;
        }

        public int getModifiers() {
            return modifiers;
        }
    }
}
