-- DropForeignKey
ALTER TABLE `operazioni` DROP FOREIGN KEY `operazioni_categoria_id_fkey`;

-- AlterTable
ALTER TABLE `operazioni` ADD COLUMN `sottotipo_operazione` VARCHAR(50) NULL,
    MODIFY `tipo_operazione` ENUM('FATTURA_ATTIVA', 'COSTO', 'CESPITE', 'PAGAMENTO_IMPOSTE', 'DISTRIBUZIONE_DIVIDENDI', 'COMPENSO_AMMINISTRATORE') NOT NULL,
    MODIFY `categoria_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `operazioni_ricorrenti` MODIFY `tipo_operazione` ENUM('FATTURA_ATTIVA', 'COSTO', 'CESPITE', 'PAGAMENTO_IMPOSTE', 'DISTRIBUZIONE_DIVIDENDI', 'COMPENSO_AMMINISTRATORE') NOT NULL;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorie_spesa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
