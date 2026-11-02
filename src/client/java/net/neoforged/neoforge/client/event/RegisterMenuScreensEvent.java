package net.neoforged.neoforge.client.event;

import net.minecraft.client.gui.screens.MenuScreens;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.MenuAccess;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.MenuType;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

public class RegisterMenuScreensEvent extends Event implements IModBusEvent {
    public <M extends AbstractContainerMenu, U extends Screen & MenuAccess<M>> void register(
            MenuType<? extends M> menuType, MenuScreens.ScreenConstructor<M, U> screenConstructor) {
        MenuScreens.register(menuType, screenConstructor);
    }
}
