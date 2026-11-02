package net.neoforged.neoforge.client.model;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;

import org.jspecify.annotations.Nullable;

import net.fabricmc.fabric.api.client.renderer.v1.mesh.QuadEmitter;
import net.minecraft.client.renderer.block.BlockAndTintGetter;
import net.minecraft.client.renderer.block.dispatch.BlockStateModel;
import net.minecraft.client.renderer.block.dispatch.BlockStateModelPart;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

/**
 * A block state model whose parts depend on the level context (model data). Fabric port: rendered through the Fabric
 * Renderer API's {@code emitQuads}.
 */
public interface DynamicBlockStateModel extends BlockStateModel {
    @Override
    @Deprecated
    default void collectParts(RandomSource random, List<BlockStateModelPart> parts) {
        collectParts(BlockAndTintGetter.EMPTY, BlockPos.ZERO, Blocks.AIR.defaultBlockState(), random, parts);
    }

    @Override
    void collectParts(BlockAndTintGetter level, BlockPos pos, BlockState state, RandomSource random,
            List<BlockStateModelPart> parts);

    @Override
    default void emitQuads(QuadEmitter emitter, BlockAndTintGetter level, BlockPos pos, BlockState state,
            RandomSource random, Predicate<@Nullable Direction> cullTest) {
        var parts = new ArrayList<BlockStateModelPart>();
        collectParts(level, pos, state, random, parts);
        for (var part : parts) {
            part.emitQuads(emitter, cullTest);
        }
    }

    @Override
    @Nullable
    default Object createGeometryKey(BlockAndTintGetter level, BlockPos pos, BlockState state, RandomSource random) {
        // Geometry depends on model data -> never cache
        return null;
    }
}
