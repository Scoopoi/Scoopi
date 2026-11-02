package net.neoforged.neoforge.client.event;

import java.util.function.Supplier;

import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.ModelLayerRegistry;
import net.minecraft.client.model.geom.ModelLayerLocation;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.renderer.blockentity.BlockEntityRendererProvider;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderers;
import net.minecraft.client.renderer.blockentity.state.BlockEntityRenderState;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public abstract class EntityRenderersEvent extends Event implements IModBusEvent {
    public static class RegisterLayerDefinitions extends EntityRenderersEvent {
        public void registerLayerDefinition(ModelLayerLocation layerLocation, Supplier<LayerDefinition> supplier) {
            ModelLayerRegistry.registerModelLayer(layerLocation, supplier::get);
        }
    }

    public static class RegisterRenderers extends EntityRenderersEvent {
        public <T extends Entity> void registerEntityRenderer(EntityType<? extends T> entityType,
                EntityRendererProvider<T> entityRendererProvider) {
            EntityRendererRegistry.register(entityType, entityRendererProvider);
        }

        public <T extends BlockEntity, S extends BlockEntityRenderState> void registerBlockEntityRenderer(
                BlockEntityType<? extends T> blockEntityType,
                BlockEntityRendererProvider<T, S> blockEntityRendererProvider) {
            BlockEntityRenderers.register(blockEntityType, blockEntityRendererProvider);
        }
    }
}
