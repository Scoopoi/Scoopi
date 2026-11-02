package appeng.fabric.gametest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.HopperBlock;
import net.minecraft.world.level.block.entity.HopperBlockEntity;

import appeng.api.config.Actionable;
import appeng.api.networking.security.IActionSource;
import appeng.api.stacks.AEItemKey;
import appeng.blockentity.networking.ControllerBlockEntity;
import appeng.blockentity.storage.DriveBlockEntity;
import appeng.core.definitions.AEBlocks;
import appeng.core.definitions.AEItems;

/**
 * Smoke test for the Fabric port: builds a small ME network in a singleplayer world, stores items in it, checks the
 * Fabric Transfer API bridge with a vanilla hopper and takes screenshots.
 */
public class AE2ClientGameTest implements FabricClientGameTest {
    private static final Logger LOG = LoggerFactory.getLogger("AE2-GameTest");

    @Override
    public void runTest(ClientGameTestContext context) {
        try (var singleplayer = context.worldBuilder().create()) {
            var server = singleplayer.getServer();
            context.waitTicks(40);

            // Build: creative energy cell - controller - drive in a row, a hopper with a cell above a second drive
            server.runOnServer(s -> {
                ServerLevel level = s.overworld();
                var player = s.getPlayerList().getPlayers().getFirst();
                var base = player.blockPosition().relative(Direction.NORTH, 3);
                level.setBlockAndUpdate(base, AEBlocks.CREATIVE_ENERGY_CELL.block().defaultBlockState());
                level.setBlockAndUpdate(base.east(), AEBlocks.CONTROLLER.block().defaultBlockState());
                level.setBlockAndUpdate(base.east(2), AEBlocks.DRIVE.block().defaultBlockState());
                level.setBlockAndUpdate(base.east(3), AEBlocks.INSCRIBER.block().defaultBlockState());
                level.setBlockAndUpdate(base.west(), AEBlocks.CHARGER.block().defaultBlockState());
                level.setBlockAndUpdate(base.west(2), AEBlocks.QUARTZ_GLASS.block().defaultBlockState());
                level.setBlockAndUpdate(base.west(3), AEBlocks.SKY_STONE_CHEST.block().defaultBlockState());
                level.setBlockAndUpdate(base.above(), AEBlocks.CRAFTING_UNIT.block().defaultBlockState());

                // Hopper -> drive (tests Fabric Transfer API -> AE2 inventory bridge)
                var drive2 = base.east(2).above();
                level.setBlockAndUpdate(drive2, AEBlocks.DRIVE.block().defaultBlockState());
                var hopperPos = drive2.above();
                level.setBlockAndUpdate(hopperPos,
                        Blocks.HOPPER.defaultBlockState().setValue(HopperBlock.FACING, Direction.DOWN));
                if (level.getBlockEntity(hopperPos) instanceof HopperBlockEntity hopper) {
                    hopper.setItem(0, AEItems.ITEM_CELL_1K.stack());
                }
                TestState.base = base;
            });
            context.waitTicks(60);

            // Put a cell into the first drive and store items through the grid
            var stored = server.computeOnServer(s -> {
                ServerLevel level = s.overworld();
                var base = TestState.base;
                var drive = (DriveBlockEntity) level.getBlockEntity(base.east(2));
                drive.getInternalInventory().insertItem(0, AEItems.ITEM_CELL_1K.stack(), false);
                var controller = (ControllerBlockEntity) level.getBlockEntity(base.east());
                var node = controller.getMainNode().getNode();
                if (node == null) {
                    throw new AssertionError("Controller has no grid node");
                }
                return node;
            });
            context.waitTicks(40);
            long amount = server.computeOnServer(s -> {
                var grid = stored.getGrid();
                var inv = grid.getStorageService().getInventory();
                var key = AEItemKey.of(Items.IRON_INGOT);
                long inserted = inv.insert(key, 64, Actionable.MODULATE, IActionSource.empty());
                LOG.info("Inserted {} iron ingots into the ME network (powered={})", inserted,
                        grid.getEnergyService().isNetworkPowered());
                return grid.getStorageService().getCachedInventory().get(key);
            });
            context.waitTicks(20);
            amount = server.computeOnServer(
                    s -> stored.getGrid().getStorageService().getCachedInventory().get(AEItemKey.of(Items.IRON_INGOT)));
            LOG.info("ME network reports {} iron ingots stored", amount);
            if (amount != 64) {
                throw new AssertionError("Expected 64 iron ingots in ME storage, got " + amount);
            }

            // Hopper bridge
            var hopperWorked = server.computeOnServer(s -> {
                var drive2 = (DriveBlockEntity) s.overworld().getBlockEntity(TestState.base.east(2).above());
                var stack = drive2.getInternalInventory().getStackInSlot(0);
                LOG.info("Drive slot 0 after hopper: {}", stack);
                return !stack.isEmpty();
            });
            if (!hopperWorked) {
                throw new AssertionError("Hopper did not insert the cell into the drive (Transfer API bridge)");
            }

            server.runCommand("tp @p ~ ~ ~ 180 35");
            context.waitTicks(60);
            context.takeScreenshot("ae2-network");

            // Open the drive GUI
            server.runOnServer(s -> {
                var player = s.getPlayerList().getPlayers().getFirst();
                var drive = (DriveBlockEntity) s.overworld().getBlockEntity(TestState.base.east(2));
                drive.openMenu(player);
            });
            context.waitTicks(40);
            context.takeScreenshot("ae2-drive-gui");
            LOG.info("AE2 Fabric smoke test passed");
        }
    }

    static final class TestState {
        static BlockPos base;
    }

    @SuppressWarnings("unused")
    private static ItemStack unused() {
        return ItemStack.EMPTY;
    }
}
