package net.neoforged.fml.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.fabricmc.loader.api.FabricLoader;
import net.neoforged.fml.ModContainer;
import net.neoforged.neoforge.common.ModConfigSpec;

public class ModConfig {
    private static final Logger LOG = LoggerFactory.getLogger(ModConfig.class);
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public enum Type {
        COMMON, CLIENT, SERVER, STARTUP;

        public String extension() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }

    private final Type type;
    private final ModConfigSpec spec;
    private final ModContainer container;
    private final String fileName;

    public ModConfig(Type type, ModConfigSpec spec, ModContainer container, String fileName) {
        this.type = type;
        this.spec = spec;
        this.container = container;
        this.fileName = fileName;
        spec.setConfig(this);
    }

    public Type getType() {
        return type;
    }

    public ModConfigSpec getSpec() {
        return spec;
    }

    public String getModId() {
        return container.getModId();
    }

    public String getFileName() {
        return fileName;
    }

    public Path getFullPath() {
        return FabricLoader.getInstance().getConfigDir().resolve(fileName);
    }

    public void load() {
        var path = getFullPath();
        boolean dirty = true;
        if (Files.exists(path)) {
            try {
                var root = JsonParser.parseString(Files.readString(path));
                dirty = spec.read(root.isJsonObject() ? root.getAsJsonObject() : new JsonObject());
            } catch (Exception e) {
                LOG.error("Failed to read config {}, using defaults", path, e);
                spec.read(new JsonObject());
            }
        } else {
            spec.read(new JsonObject());
        }
        if (dirty) {
            save();
        }
    }

    public void save() {
        var path = getFullPath();
        try {
            Files.createDirectories(path.getParent());
            Files.writeString(path, GSON.toJson(spec.write()));
        } catch (IOException e) {
            LOG.error("Failed to write config {}", path, e);
        }
    }
}
