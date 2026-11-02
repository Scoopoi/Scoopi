package net.neoforged.neoforge.fluids;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;

import net.fabricmc.fabric.api.transfer.v1.fluid.FluidVariant;
import net.fabricmc.fabric.api.transfer.v1.fluid.FluidVariantAttributes;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.material.Fluid;
import net.neoforged.neoforge.common.SoundActions;
import net.neoforged.neoforge.common.sounds.SoundAction;

/**
 * Minimal Fabric-backed replacement for NeoForge's FluidType, delegating to Fabric's fluid variant attributes.
 */
public final class FluidType {
    public static final int BUCKET_VOLUME = 1000;

    private static final Map<Fluid, FluidType> TYPES = new ConcurrentHashMap<>();

    private final Fluid fluid;

    private FluidType(Fluid fluid) {
        this.fluid = fluid;
    }

    public static FluidType of(Fluid fluid) {
        return TYPES.computeIfAbsent(fluid, FluidType::new);
    }

    private FluidVariant variant() {
        return FluidVariant.of(fluid);
    }

    @Nullable
    public SoundEvent getSound(SoundAction action) {
        if (action.equals(SoundActions.BUCKET_FILL)) {
            return FluidVariantAttributes.getFillSound(variant());
        } else if (action.equals(SoundActions.BUCKET_EMPTY)) {
            return FluidVariantAttributes.getEmptySound(variant());
        }
        return null;
    }

    @Nullable
    public SoundEvent getSound(@Nullable Player player, SoundAction action) {
        return getSound(action);
    }

    @Nullable
    public SoundEvent getSound(FluidStack stack, SoundAction action) {
        return getSound(action);
    }

    public boolean isLighterThanAir() {
        return FluidVariantAttributes.isLighterThanAir(variant());
    }

    public Component getDescription() {
        return FluidVariantAttributes.getName(variant());
    }

    public Component getDescription(FluidStack stack) {
        return getDescription();
    }

    public String getDescriptionId() {
        return getDescription().getContents() instanceof net.minecraft.network.chat.contents.TranslatableContents t
                ? t.getKey()
                : "block.minecraft.water";
    }

    public String getDescriptionId(FluidStack stack) {
        return getDescriptionId();
    }

    public ItemStack getBucket(FluidStack stack) {
        return new ItemStack(fluid.getBucket());
    }
}
