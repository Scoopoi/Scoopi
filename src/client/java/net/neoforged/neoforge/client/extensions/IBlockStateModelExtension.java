package net.neoforged.neoforge.client.extensions;

import java.util.List;

import net.minecraft.client.renderer.block.BlockAndTintGetter;
import net.minecraft.client.renderer.block.dispatch.BlockStateModel;
import net.minecraft.client.renderer.block.dispatch.BlockStateModelPart;
import net.minecraft.core.BlockPos;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.block.state.BlockState;

/** Injected into {@link BlockStateModel}: NeoForge's context-aware part collection. */
public interface IBlockStateModelExtension {
    default void collectParts(BlockAndTintGetter level, BlockPos pos, BlockState state, RandomSource random,
            List<BlockStateModelPart> parts) {
        ((BlockStateModel) this).collectParts(random, parts);
    }
}
