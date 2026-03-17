-- DropForeignKey
ALTER TABLE `operazioni` DROP FOREIGN KEY `operazioni_categoria_id_fkey`;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorie_spesa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
