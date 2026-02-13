-- DropForeignKey
ALTER TABLE `soci` DROP FOREIGN KEY `soci_societa_id_fkey`;

-- DropIndex
DROP INDEX `soci_societa_id_fkey` ON `soci`;

-- AlterTable
ALTER TABLE `soci` MODIFY `societa_id` INTEGER NULL,
    MODIFY `ruolo` ENUM('ADMIN', 'STANDARD', 'SUPER_ADMIN') NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE `utenti` ADD COLUMN `email_verificata` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `verifica_email` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `codice` VARCHAR(5) NOT NULL,
    `scadenza` DATETIME(3) NOT NULL,
    `verificato` BOOLEAN NOT NULL DEFAULT false,
    `tentativi` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `verifica_email_email_verificato_scadenza_idx`(`email`, `verificato`, `scadenza`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `soci` ADD CONSTRAINT `soci_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
