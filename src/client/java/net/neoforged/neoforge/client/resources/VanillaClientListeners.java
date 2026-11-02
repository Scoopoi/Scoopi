package net.neoforged.neoforge.client.resources;

import net.fabricmc.fabric.api.resource.v1.reloader.ResourceReloaderKeys;
import net.minecraft.resources.Identifier;

public final class VanillaClientListeners {
    public static final Identifier BLOCK_ENTITY_RENDERER = ResourceReloaderKeys.Client.BLOCK_ENTITY_RENDER_DISPATCHER;
    public static final Identifier MODELS = ResourceReloaderKeys.Client.MODELS;

    private VanillaClientListeners() {
    }
}
