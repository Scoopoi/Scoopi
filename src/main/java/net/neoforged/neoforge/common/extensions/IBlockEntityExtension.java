package net.neoforged.neoforge.common.extensions;

import net.minecraft.world.level.block.entity.BlockEntity;
import net.neoforged.neoforge.model.data.ModelData;

/** Injected into {@link BlockEntity}. */
public interface IBlockEntityExtension {
    private BlockEntity self() {
        return (BlockEntity) this;
    }

    /** Called when the chunk containing this block entity is unloaded (not when it is removed). */
    default void onChunkUnloaded() {
    }

    /** Called when the block entity is first added to a loaded level. */
    default void onLoad() {
        requestModelDataUpdate();
    }

    default ModelData getModelData() {
        return ModelData.EMPTY;
    }

    default void requestModelDataUpdate() {
        var be = self();
        var level = be.getLevel();
        if (level != null && level.isClientSide()) {
            appeng.fabric.shim.ShimClientHooks.requestRerender(level, be.getBlockPos());
        }
    }

    default void invalidateCapabilities() {
        var be = self();
        var level = be.getLevel();
        if (level != null) {
            level.invalidateCapabilities(be.getBlockPos());
        }
    }
}
