-- AlterTable
ALTER TABLE `operazioni` ADD COLUMN `ai_confidence` DOUBLE NULL,
    ADD COLUMN `ai_suggestion_id` INTEGER NULL,
    ADD COLUMN `chiave_import` VARCHAR(255) NULL,
    ADD COLUMN `sorgente` VARCHAR(50) NULL;

-- CreateIndex
CREATE INDEX `operazioni_societa_id_chiave_import_idx` ON `operazioni`(`societa_id`, `chiave_import`);
