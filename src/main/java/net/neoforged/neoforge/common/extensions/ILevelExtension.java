package net.neoforged.neoforge.common.extensions;

import org.jspecify.annotations.Nullable;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.neoforged.neoforge.capabilities.BlockCapability;
import net.neoforged.neoforge.capabilities.ICapabilityInvalidationListener;

import appeng.fabric.shim.CapabilityLevelHooks;

/** Injected into {@link Level} via Loom interface injection + mixin. */
public interface ILevelExtension {
    private Level self() {
        return (Level) this;
    }

    @Nullable
    default <T, C> T getCapability(BlockCapability<T, C> cap, BlockPos pos, C context) {
        return cap.getCapability(self(), pos, null, null, context);
    }

    @Nullable
    default <T, C> T getCapability(BlockCapability<T, C> cap, BlockPos pos, @Nullable BlockState state,
            @Nullable BlockEntity blockEntity, C context) {
        return cap.getCapability(self(), pos, state, blockEntity, context);
    }

    @Nullable
    default <T> T getCapability(BlockCapability<T, @Nullable Void> cap, BlockPos pos) {
        return cap.getCapability(self(), pos, null, null, null);
    }

    @Nullable
    default <T> T getCapability(BlockCapability<T, @Nullable Void> cap, BlockPos pos, @Nullable BlockState state,
            @Nullable BlockEntity blockEntity) {
        return cap.getCapability(self(), pos, state, blockEntity, null);
    }

    default void invalidateCapabilities(BlockPos pos) {
        CapabilityLevelHooks.invalidate(self(), pos);
    }

    default void invalidateCapabilities(ChunkPos pos) {
        CapabilityLevelHooks.invalidate(self(), pos);
    }

    default void registerCapabilityListener(BlockPos pos, ICapabilityInvalidationListener listener) {
        CapabilityLevelHooks.registerListener(self(), pos, listener);
    }
}
