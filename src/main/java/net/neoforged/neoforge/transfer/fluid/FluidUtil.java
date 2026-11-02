/*
 * Copyright (c) NeoForged and contributors
 * SPDX-License-Identifier: LGPL-2.1-only
 */

package net.neoforged.neoforge.transfer.fluid;

import com.google.common.base.Preconditions;
import com.mojang.logging.LogUtils;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.BucketItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.BucketPickup;
import net.minecraft.world.level.block.LiquidBlockContainer;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.gameevent.GameEvent;
import net.minecraft.world.level.material.Fluid;
import net.minecraft.world.level.material.Fluids;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.capabilities.Capabilities;
import net.neoforged.neoforge.common.SoundActions;
import net.neoforged.neoforge.fluids.FluidStack;
import net.neoforged.neoforge.fluids.FluidType;
import net.neoforged.neoforge.transfer.ResourceHandler;
import net.neoforged.neoforge.transfer.ResourceHandlerUtil;
import net.neoforged.neoforge.transfer.access.ItemAccess;
import net.neoforged.neoforge.transfer.resource.ResourceStack;
import net.neoforged.neoforge.transfer.transaction.RootCommitJournal;
import net.neoforged.neoforge.transfer.transaction.Transaction;
import net.neoforged.neoforge.transfer.transaction.TransactionContext;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;

/**
 * Helper functions to work with {@link ResourceHandler}s of {@link FluidResource}s.
 */
public final class FluidUtil {
    private static final Logger LOGGER = LogUtils.getLogger();

    private FluidUtil() {}

    /**
     * Returns a new fluid stack with the contents of the handler at the given index.
     */
    public static FluidStack getStack(ResourceHandler<FluidResource> handler, int index) {
        var resource = handler.getResource(index);
        if (resource.isEmpty()) {
            return FluidStack.EMPTY;
        }
        return resource.toStack(handler.getAmountAsInt(index));
    }

    /**
     * Returns a new fluid stack with the first fluid contents of the given item stack,
     * ignoring the count of the stack.
     *
     * <p>The contents from the first non-empty index are returned.
     * As such the returned contents might not be extractable, and the stack might contain additional contents.
     *
     * <p>{@link FluidStack#EMPTY} is returned if the given stack is {@linkplain ItemStack#EMPTY empty}.
     */
    public static FluidStack getFirstStackContained(ItemStack stack) {
        if (stack.isEmpty()) {
            return FluidStack.EMPTY;
        }
        var handler = ItemAccess.forStack(stack).oneByOne().getCapability(Capabilities.Fluid.ITEM);
        if (handler == null) {
            return FluidStack.EMPTY;
        }
        int size = handler.size();
        for (int index = 0; index < size; ++index) {
            var fluidStack = getStack(handler, index);
            if (!fluidStack.isEmpty()) {
                return fluidStack;
            }
        }
        return FluidStack.EMPTY;
    }

    /**
     * Used to handle the common case of a player holding a fluid item and right-clicking on a fluid handler block.
     * First it tries to fill the item from the block,
     * if that action fails then it tries to drain the item into the block.
     * Automatically updates the item in the player's hand and stashes any extra items created.
     *
     * @param player The player doing the interaction between the item and fluid handler block.
     * @param hand   The player's hand that is holding an item that should interact with the fluid handler block.
     * @param level  The level that contains the fluid handler block.
     * @param pos    The position of the fluid handler block in the level.
     * @param side   The side of the block to interact with. May be null.
     * @return true if the interaction succeeded, false otherwise.
     * @deprecated Use {@link #interactWithFluidHandler(Player, InteractionHand, Level, BlockPos, Direction, TransactionContext)} instead.
     */
    @Deprecated(since = "26.1.2", forRemoval = true)
    public static boolean interactWithFluidHandler(Player player, InteractionHand hand, Level level, BlockPos pos, @Nullable Direction side) {
        return interactWithFluidHandler(player, hand, level, pos, side, null);
    }

    /// Used to handle the common case of a player holding a fluid item and right-clicking on a fluid handler block.
    /// First it tries to fill the item from the block,
    /// if that action fails then it tries to drain the item into the block.
    /// Automatically updates the item in the player's hand and stashes any extra items created.
    ///
    /// @param player The player doing the interaction between the item and fluid handler block.
    /// @param hand   The player's hand that is holding an item that should interact with the fluid handler block.
    /// @param level  The level that contains the fluid handler block.
    /// @param pos    The position of the fluid handler block in the level.
    /// @param side   The side of the block to interact with. May be null.
    /// @param transaction The transaction context for the operation. Passing in `null` will open a root transaction, whereas passing in a transaction will
    /// allow you to make the final decision to commit based on the results of this method.
    /// @return true if the interaction succeeded, false otherwise.
    public static boolean interactWithFluidHandler(Player player, InteractionHand hand, Level level, BlockPos pos, @Nullable Direction side, @Nullable TransactionContext transaction) {
        Preconditions.checkNotNull(level);
        Preconditions.checkNotNull(pos);

        var fluidHandler = level.getCapability(Capabilities.Fluid.BLOCK, pos, side);
        return fluidHandler != null && interactWithFluidHandler(player, hand, pos, fluidHandler, transaction);
    }

    /**
     * Used to handle the common case of a player holding a fluid item and right-clicking on a fluid handler.
     * First it tries to fill the item from the handler,
     * if that action fails then it tries to drain the item into the handler.
     * Automatically updates the item in the player's hand and stashes any extra items created.
     *
     * @param player  The player doing the interaction between the item and fluid handler.
     * @param hand    The player's hand that is holding an item that should interact with the fluid handler.
     * @param pos     The position at which to send game events and play sounds. If {@code null}, the player's position will be used.
     * @param handler The fluid handler.
     * @return true if the interaction succeeded, false otherwise.
     * @deprecated Use {@link #interactWithFluidHandler(Player, InteractionHand, BlockPos, ResourceHandler, TransactionContext)} instead.
     */
    @Deprecated(since = "26.1.2", forRemoval = true)
    public static boolean interactWithFluidHandler(Player player, InteractionHand hand, @Nullable BlockPos pos, ResourceHandler<FluidResource> handler) {
        return interactWithFluidHandler(player, hand, pos, handler, null);
    }

    /// Used to handle the common case of a player holding a fluid item and right-clicking on a fluid handler.
    /// First it tries to fill the item from the handler,
    /// if that action fails then it tries to drain the item into the handler.
    /// Automatically updates the item in the player's hand and stashes any extra items created.
    ///
    /// @param player  The player doing the interaction between the item and fluid handler.
    /// @param hand    The player's hand that is holding an item that should interact with the fluid handler.
    /// @param pos     The position at which to send game events and play sounds. If `null`, the player's position will be used.
    /// @param handler The fluid handler.
    /// @param transaction The transaction context for the operation. Passing in `null` will open a root transaction, whereas passing in a transaction will
    /// allow you to make the final decision to commit based on the results of this method.
    /// @return true if the interaction succeeded, false otherwise.
    public static boolean interactWithFluidHandler(Player player, InteractionHand hand, @Nullable BlockPos pos, ResourceHandler<FluidResource> handler, @Nullable TransactionContext transaction) {
        var itemAccess = ItemAccess.forPlayerInteraction(player, hand).oneByOne();
        var handHandler = itemAccess.getCapability(Capabilities.Fluid.ITEM);
        if (handHandler == null) {
            return false;
        }

        return moveWithSound(handler, handHandler, player.level(), pos, player, transaction, true) != null
                || moveWithSound(handHandler, handler, player.level(), pos, player, transaction, false) != null;
    }

    @Nullable
    private static ResourceStack<FluidResource> moveWithSound(ResourceHandler<FluidResource> from, ResourceHandler<FluidResource> to, Level level, @Nullable BlockPos pos,
            @Nullable Player player, @Nullable TransactionContext transaction, boolean pickup) {
        if (player == null && pos == null) {
            throw new IllegalArgumentException("Either player or pos must be provided.");
        }

        var moved = ResourceHandlerUtil.moveFirst(from, to, fr -> true, Integer.MAX_VALUE, transaction);
        if (moved != null) {
            playSoundAndGameEvent(moved.resource(), level, pos, player, transaction, pickup);
        }
        return moved;
    }

    private static void playSoundAndGameEvent(FluidResource resource, Level level, @Nullable BlockPos blockPos, @Nullable Player player, @Nullable TransactionContext transaction, boolean pickup) {
        if (player == null && blockPos == null) {
            throw new IllegalArgumentException("Either player or blockPos must be provided.");
        }

        // Prioritize block position, use player position as a fallback
        Vec3 position = blockPos != null ? Vec3.atCenterOf(blockPos) : new Vec3(player.getX(), player.getY() + 0.5, player.getZ());

        if (transaction == null) {
            //No transaction, just trigger the sound and game event immediately
            triggerSoundAndGameEvent(resource, level, position, player, pickup);
        } else {
            //Trigger on root commit
            RootCommitJournal onRootCommit = new RootCommitJournal(() -> triggerSoundAndGameEvent(resource, level, position, player, pickup));
            onRootCommit.updateSnapshots(transaction);
        }
    }

    /**
     * Triggers the appropriate sound effect and game event for an interaction with a fluid handler.
     *
     * @param resource The resource that was moved during the interaction.
     * @param level    The level the interaction occurred in.
     * @param position Where the interaction occurred at. The sound and game event will trigger here.
     * @param player   The player that caused the interaction (optional). The game event will be attributed to them.
     * @param pickup   True if the fluid was extracted from the handler, false if it was inserted.
     */
    public static void triggerSoundAndGameEvent(FluidResource resource, Level level, Vec3 position, @Nullable Player player, boolean pickup) {
        var stack = resource.toStack(FluidType.BUCKET_VOLUME);
        var soundEvent = resource.getFluidType().getSound(stack, pickup ? SoundActions.BUCKET_FILL : SoundActions.BUCKET_EMPTY);
        if (soundEvent != null) {
            level.playSound(null, position.x, position.y, position.z, soundEvent, SoundSource.BLOCKS, 1.0F, 1.0F);
        }
        level.gameEvent(player, pickup ? GameEvent.FLUID_PICKUP : GameEvent.FLUID_PLACE, position);
    }
}
