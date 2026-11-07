package com.scoopi.stormbow;

import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.BowItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;

/** A bow whose arrows lift their target into the air and call down lightning on it. */
public class StormcallerBowItem extends BowItem {
    public StormcallerBowItem(Properties properties) {
        super(properties);
    }

    @Override
    protected Projectile createProjectile(Level level, LivingEntity shooter, ItemStack weapon, ItemStack ammo,
                                          boolean isCrit) {
        Projectile projectile = super.createProjectile(level, shooter, weapon, ammo, isCrit);
        projectile.addTag(Stormcaller.ARROW_TAG);
        if (projectile instanceof AbstractArrow arrow) {
            arrow.setCritArrow(true);
            SmiteManager.trackArrow(arrow);
        }
        return projectile;
    }
}
