/*
 * Copyright (c) Forge Development LLC and contributors
 * SPDX-License-Identifier: LGPL-2.1-only
 */

package net.neoforged.neoforge.event.level;

import java.util.List;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.util.ProgressListener;
import net.minecraft.util.random.Weighted;
import net.minecraft.util.random.WeightedList;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.biome.MobSpawnSettings;
import net.minecraft.world.level.storage.ServerLevelData;
import net.neoforged.bus.api.Event;
import net.neoforged.bus.api.ICancellableEvent;
import net.neoforged.fml.LogicalSide;
import net.neoforged.neoforge.common.NeoForge;
import org.jspecify.annotations.Nullable;

/**
 * This event is fired whenever an event involving a {@link LevelAccessor} occurs.
 * <p>
 * All children of this event are fired on the {@linkplain NeoForge#EVENT_BUS main Forge event bus}.
 */
public abstract class LevelEvent extends Event {
    private final LevelAccessor level;

    public LevelEvent(LevelAccessor level) {
        this.level = level;
    }

    /**
     * {@return the level this event is affecting}
     */
    public LevelAccessor getLevel() {
        return level;
    }

    /**
     * This event is fired whenever a level loads.
     * This event is fired whenever a level loads in ClientLevel's constructor and
     * {@literal MinecraftServer#createLevels(ChunkProgressListener)}.
     * <p>
     * This event is not {@linkplain ICancellableEvent cancellable} and does not {@linkplain HasResult have a result}.
     * <p>
     * This event is fired on the {@linkplain NeoForge#EVENT_BUS main Forge event bus}
     * on both logical sides.
     **/
    public static class Load extends LevelEvent {
        public Load(LevelAccessor level) {
            super(level);
        }
    }

    /// Fired whenever a level unloads. This may be due to the server being stopped, or the client switching to another level or server.
    ///
    /// This event is not [cancellable][ICancellableEvent].
    ///
    /// This event is fired on the [game event bus][NeoForge#EVENT_BUS] on both [logical sides][LogicalSide].
    public static class Unload extends LevelEvent {
        public Unload(LevelAccessor level) {
            super(level);
        }
    }

    /**
     * This event fires whenever a level is saved.
     * This event is fired when a level is saved in
     * {@link ServerLevel#save(ProgressListener, boolean, boolean)}.
     * <p>
     * This event is not {@linkplain ICancellableEvent cancellable} and does not {@linkplain HasResult have a result}.
     * <p>
     * This event is fired on the {@linkplain NeoForge#EVENT_BUS main Forge event bus}
     * only on the {@linkplain LogicalSide#SERVER logical server}.
     **/
    public static class Save extends LevelEvent {
        public Save(LevelAccessor level) {
            super(level);
        }
    }

    /**
     * This event fires whenever a {@link ServerLevel} is initialized for the first time
     * and a spawn position needs to be chosen.
     * <p>
     * This event is {@linkplain ICancellableEvent cancellable} and does not {@linkplain HasResult have a result}.
     * If the event is canceled, the vanilla logic to choose a spawn position will be skipped.
     * <p>
     * This event is fired on the {@linkplain NeoForge#EVENT_BUS main Forge event bus}
     * only on the {@linkplain LogicalSide#SERVER logical server}.
     *
     * @see ServerLevelData#isInitialized()
     */
    public static class CreateSpawnPosition extends LevelEvent implements ICancellableEvent {
        private final ServerLevelData settings;

        public CreateSpawnPosition(LevelAccessor level, ServerLevelData settings) {
            super(level);
            this.settings = settings;
        }

        public ServerLevelData getSettings() {
            return settings;
        }
    }

}
