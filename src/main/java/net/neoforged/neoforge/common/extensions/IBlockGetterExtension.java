package net.neoforged.neoforge.common.extensions;

import net.fabricmc.fabric.api.blockgetter.v2.FabricBlockGetter;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.BlockGetter;
import net.neoforged.neoforge.model.data.ModelData;

/**
 * Injected into {@link BlockGetter}. Provides model data of block entities for rendering, backed by Fabric's
 * block entity render data (which render regions snapshot on the main thread).
 */
public interface IBlockGetterExtension {
    default ModelData getModelData(BlockPos pos) {
        var data = ((FabricBlockGetter) this).getBlockEntityRenderData(pos);
        return data instanceof ModelData modelData ? modelData : ModelData.EMPTY;
    }
}
