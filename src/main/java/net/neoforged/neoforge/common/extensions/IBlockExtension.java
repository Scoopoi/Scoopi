package net.neoforged.neoforge.common.extensions;

import org.jspecify.annotations.Nullable;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Explosion;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;

/** Injected into {@link Block}. Only the hooks AE2 relies on are provided. */
public interface IBlockExtension {

    default boolean onCaughtFire(BlockState state, Level level, BlockPos pos, @Nullable Direction direction,
            @Nullable LivingEntity igniter) {
        return false;
    }

    default boolean isLadder(BlockState state, LevelReader level, BlockPos pos, LivingEntity entity) {
        return false;
    }

    default boolean canEntityDestroy(BlockState state, BlockGetter level, BlockPos pos, Entity entity) {
        return true;
    }

    default boolean canConnectRedstone(BlockState state, BlockGetter level, BlockPos pos,
            @Nullable Direction direction) {
        return state.isSignalSource() && direction != null;
    }

    default ItemStack getCloneItemStack(LevelReader level, BlockPos pos, BlockState state, boolean includeData,
            @Nullable Player player) {
        return state.getCloneItemStack(level, pos, includeData);
    }

    default void onBlockExploded(BlockState state, ServerLevel level, BlockPos pos, Explosion explosion) {
        level.setBlock(pos, net.minecraft.world.level.block.Blocks.AIR.defaultBlockState(), 3);
    }

    /** Called when a neighboring block entity changes (comparator-style updates). */
    default void onNeighborChange(BlockState state, LevelReader level, BlockPos pos, BlockPos neighbor) {
    }
}
