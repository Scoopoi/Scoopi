package net.neoforged.neoforge.common;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;

import org.jetbrains.annotations.Nullable;

import net.neoforged.fml.config.ModConfig;

/**
 * Small re-implementation of the NeoForge config spec API backed by a JSON file. Only the features used by AE2 are
 * supported.
 */
public class ModConfigSpec {
    private final List<ConfigValue<?>> values;
    @Nullable
    ModConfig config;

    private ModConfigSpec(List<ConfigValue<?>> values) {
        this.values = Collections.unmodifiableList(values);
        for (var v : values) {
            v.spec = this;
        }
    }

    public List<ConfigValue<?>> getValues() {
        return values;
    }

    public void setConfig(@Nullable ModConfig config) {
        this.config = config;
    }

    public boolean isLoaded() {
        return config != null;
    }

    public void save() {
        if (config != null) {
            config.save();
        }
    }

    /** Apply values from a JSON tree, returns true if the file needs to be rewritten. */
    public boolean read(JsonObject root) {
        boolean dirty = false;
        for (var v : values) {
            JsonObject node = root;
            for (int i = 0; i < v.path.size() - 1; i++) {
                var child = node.get(v.path.get(i));
                if (child == null || !child.isJsonObject()) {
                    node = null;
                    break;
                }
                node = child.getAsJsonObject();
            }
            var el = node == null ? null : node.get(v.path.getLast());
            if (el == null || !v.readJson(el)) {
                v.reset();
                dirty = true;
            }
        }
        return dirty;
    }

    public JsonObject write() {
        var root = new JsonObject();
        for (var v : values) {
            JsonObject node = root;
            for (int i = 0; i < v.path.size() - 1; i++) {
                var key = v.path.get(i);
                var child = node.get(key);
                if (child == null) {
                    child = new JsonObject();
                    node.add(key, child);
                }
                node = child.getAsJsonObject();
            }
            if (v.comment != null) {
                node.addProperty("_comment_" + v.path.getLast(), v.comment);
            }
            node.add(v.path.getLast(), v.writeJson());
        }
        return root;
    }

    public static class Builder {
        private final List<String> currentPath = new ArrayList<>();
        private final List<ConfigValue<?>> values = new ArrayList<>();
        @Nullable
        private String pendingComment;

        public Builder push(String path) {
            currentPath.add(path);
            pendingComment = null;
            return this;
        }

        public Builder pop() {
            currentPath.removeLast();
            return this;
        }

        public Builder pop(int count) {
            for (int i = 0; i < count; i++) {
                pop();
            }
            return this;
        }

        public Builder comment(String comment) {
            pendingComment = comment;
            return this;
        }

        public Builder comment(String... comment) {
            pendingComment = String.join("\n", comment);
            return this;
        }

        public Builder translation(String key) {
            return this;
        }

        private <T extends ConfigValue<?>> T add(String name, T value) {
            var path = new ArrayList<>(currentPath);
            path.add(name);
            value.path = path;
            value.comment = pendingComment;
            pendingComment = null;
            values.add(value);
            return value;
        }

        public BooleanValue define(String name, boolean defaultValue) {
            return add(name, new BooleanValue(defaultValue));
        }

        public <T> ConfigValue<T> define(String name, T defaultValue) {
            if (defaultValue instanceof Boolean b) {
                @SuppressWarnings("unchecked")
                var r = (ConfigValue<T>) (ConfigValue<?>) define(name, (boolean) b);
                return r;
            }
            return add(name, new StringLikeValue<>(defaultValue));
        }

        public IntValue defineInRange(String name, int defaultValue, int min, int max) {
            return add(name, new IntValue(defaultValue, min, max));
        }

        public LongValue defineInRange(String name, long defaultValue, long min, long max) {
            return add(name, new LongValue(defaultValue, min, max));
        }

        public DoubleValue defineInRange(String name, double defaultValue, double min, double max) {
            return add(name, new DoubleValue(defaultValue, min, max));
        }

        public <V extends Enum<V>> EnumValue<V> defineEnum(String name, V defaultValue) {
            return add(name, new EnumValue<>(defaultValue));
        }

        public ModConfigSpec build() {
            return new ModConfigSpec(values);
        }
    }

    public abstract static class ConfigValue<T> implements Supplier<T> {
        List<String> path;
        @Nullable
        String comment;
        @Nullable
        ModConfigSpec spec;
        protected final T defaultValue;
        protected T value;

        protected ConfigValue(T defaultValue) {
            this.defaultValue = defaultValue;
            this.value = defaultValue;
        }

        public List<String> getPath() {
            return path;
        }

        @Override
        public T get() {
            return value;
        }

        public T getRaw() {
            return value;
        }

        public T getDefault() {
            return defaultValue;
        }

        public void set(T value) {
            this.value = value;
        }

        public void save() {
            if (spec != null) {
                spec.save();
            }
        }

        void reset() {
            value = defaultValue;
        }

        abstract boolean readJson(JsonElement el);

        abstract JsonElement writeJson();
    }

    public static class BooleanValue extends ConfigValue<Boolean> implements java.util.function.BooleanSupplier {
        BooleanValue(boolean def) {
            super(def);
        }

        @Override
        public boolean getAsBoolean() {
            return value;
        }

        public boolean isTrue() {
            return value;
        }

        public boolean isFalse() {
            return !value;
        }

        @Override
        boolean readJson(JsonElement el) {
            if (el instanceof JsonPrimitive p && p.isBoolean()) {
                value = p.getAsBoolean();
                return true;
            }
            return false;
        }

        @Override
        JsonElement writeJson() {
            return new JsonPrimitive(value);
        }
    }

    public static class IntValue extends ConfigValue<Integer> implements java.util.function.IntSupplier {
        private final int min, max;

        IntValue(int def, int min, int max) {
            super(def);
            this.min = min;
            this.max = max;
        }

        @Override
        public int getAsInt() {
            return value;
        }

        @Override
        boolean readJson(JsonElement el) {
            if (el instanceof JsonPrimitive p && p.isNumber()) {
                var v = p.getAsInt();
                if (v >= min && v <= max) {
                    value = v;
                    return true;
                }
            }
            return false;
        }

        @Override
        JsonElement writeJson() {
            return new JsonPrimitive(value);
        }
    }

    public static class LongValue extends ConfigValue<Long> implements java.util.function.LongSupplier {
        private final long min, max;

        LongValue(long def, long min, long max) {
            super(def);
            this.min = min;
            this.max = max;
        }

        @Override
        public long getAsLong() {
            return value;
        }

        @Override
        boolean readJson(JsonElement el) {
            if (el instanceof JsonPrimitive p && p.isNumber()) {
                var v = p.getAsLong();
                if (v >= min && v <= max) {
                    value = v;
                    return true;
                }
            }
            return false;
        }

        @Override
        JsonElement writeJson() {
            return new JsonPrimitive(value);
        }
    }

    public static class DoubleValue extends ConfigValue<Double> implements java.util.function.DoubleSupplier {
        private final double min, max;

        DoubleValue(double def, double min, double max) {
            super(def);
            this.min = min;
            this.max = max;
        }

        @Override
        public double getAsDouble() {
            return value;
        }

        @Override
        boolean readJson(JsonElement el) {
            if (el instanceof JsonPrimitive p && p.isNumber()) {
                var v = p.getAsDouble();
                if (v >= min && v <= max) {
                    value = v;
                    return true;
                }
            }
            return false;
        }

        @Override
        JsonElement writeJson() {
            return new JsonPrimitive(value);
        }
    }

    public static class EnumValue<T extends Enum<T>> extends ConfigValue<T> {
        EnumValue(T def) {
            super(def);
        }

        @Override
        boolean readJson(JsonElement el) {
            if (el instanceof JsonPrimitive p && p.isString()) {
                for (var c : defaultValue.getDeclaringClass().getEnumConstants()) {
                    if (c.name().equalsIgnoreCase(p.getAsString())) {
                        value = c;
                        return true;
                    }
                }
            }
            return false;
        }

        @Override
        JsonElement writeJson() {
            return new JsonPrimitive(value.name());
        }
    }

    static class StringLikeValue<T> extends ConfigValue<T> {
        StringLikeValue(T def) {
            super(def);
        }

        @SuppressWarnings("unchecked")
        @Override
        boolean readJson(JsonElement el) {
            if (defaultValue instanceof String && el instanceof JsonPrimitive p && p.isString()) {
                value = (T) p.getAsString();
                return true;
            }
            return false;
        }

        @Override
        JsonElement writeJson() {
            return new JsonPrimitive(String.valueOf(value));
        }
    }

    // Unused but kept for API shape
    static final Map<String, Object> EMPTY = new LinkedHashMap<>();
}
