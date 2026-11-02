package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.LevelChunk;

import appeng.fabric.shim.CapabilityLevelHooks;

/**
 * Invalidate capability caches whenever block entities or blocks change, like NeoForge does.
 */
@Mixin(LevelChunk.class)
public abstract class LevelChunkCapabilityMixin {
    @Shadow
    @Final
    Level level;

    @Inject(method = "setBlockEntity", at = @At("TAIL"))
    private void ae2_afterSetBlockEntity(BlockEntity blockEntity, CallbackInfo ci) {
        CapabilityLevelHooks.invalidate(level, blockEntity.getBlockPos());
    }

    @Inject(method = "removeBlockEntity", at = @At("TAIL"))
    private void ae2_afterRemoveBlockEntity(BlockPos pos, CallbackInfo ci) {
        CapabilityLevelHooks.invalidate(level, pos);
    }

    @Inject(method = "setBlockState", at = @At("RETURN"))
    private void ae2_afterSetBlockState(BlockPos pos, BlockState state, int flags,
            CallbackInfoReturnable<BlockState> cir) {
        var old = cir.getReturnValue();
        if (old != null && old.getBlock() != state.getBlock()) {
            CapabilityLevelHooks.invalidate(level, pos);
        }
    }
}
