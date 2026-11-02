/*
 * Copyright (c) NeoForged and contributors
 * SPDX-License-Identifier: LGPL-2.1-only
 */

package net.neoforged.neoforge.registries.callback;


/**
 * Marker interface for registry callbacks.
 * Register to addCallback.
 */
public sealed interface RegistryCallback<T> permits AddCallback, BakeCallback, ClearCallback {}
