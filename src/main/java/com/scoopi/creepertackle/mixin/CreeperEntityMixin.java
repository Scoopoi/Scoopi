package com.scoopi.creepertackle.mixin;

import com.scoopi.creepertackle.TackleableCreeper;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.mob.CreeperEntity;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(CreeperEntity.class)
public abstract class CreeperEntityMixin extends HostileEntity implements TackleableCreeper {
    @Shadow private int currentFuseTime;
    @Shadow private int lastFuseTime;

    @Shadow public abstract void setFuseSpeed(int fuseSpeed);

    @Unique private boolean creepertackle$defused;
    @Unique private int creepertackle$stunTicks;

    protected CreeperEntityMixin(EntityType<? extends HostileEntity> type, World world) {
        super(type, world);
    }

    @Override
    public boolean creepertackle$isDefused() {
        return creepertackle$defused;
    }

    @Override
    public int creepertackle$getStunTicks() {
        return creepertackle$stunTicks;
    }

    @Override
    public void creepertackle$tackle(int stunTicks) {
        creepertackle$defused = true;
        creepertackle$stunTicks = stunTicks;
        setFuseSpeed(-1);
        currentFuseTime = 0;
        lastFuseTime = 0;
        getNavigation().stop();
        // Pinned: can't walk while lying on the ground.
        addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, stunTicks, 9, false, false, false));
    }

    /** Defused creepers can never start fusing again (AI, flint & steel, anything). */
    @ModifyVariable(method = "setFuseSpeed", at = @At("HEAD"), argsOnly = true)
    private int creepertackle$blockFuse(int fuseSpeed) {
        return creepertackle$defused ? -1 : fuseSpeed;
    }

    /** Belt and braces: a defused creeper never explodes. */
    @Inject(method = "explode", at = @At("HEAD"), cancellable = true)
    private void creepertackle$noBoom(CallbackInfo ci) {
        if (creepertackle$defused) {
            currentFuseTime = 0;
            ci.cancel();
        }
    }

    @Inject(method = "tick", at = @At("HEAD"))
    private void creepertackle$tickStun(CallbackInfo ci) {
        if (creepertackle$stunTicks > 0) {
            creepertackle$stunTicks--;
            getNavigation().stop();
            if (isOnGround()) {
                Vec3d v = getVelocity();
                setVelocity(v.x * 0.2, v.y, v.z * 0.2);
            }
        }
    }

    @Inject(method = "writeCustomDataToNbt", at = @At("TAIL"))
    private void creepertackle$write(NbtCompound nbt, CallbackInfo ci) {
        nbt.putBoolean("CreeperTackleDefused", creepertackle$defused);
    }

    @Inject(method = "readCustomDataFromNbt", at = @At("TAIL"))
    private void creepertackle$read(NbtCompound nbt, CallbackInfo ci) {
        creepertackle$defused = nbt.getBoolean("CreeperTackleDefused");
    }
}
