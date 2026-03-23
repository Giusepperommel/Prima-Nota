/*
  Warnings:

  - A unique constraint covering the columns `[societa_id,email]` on the table `soci` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `soci_email_key` ON `soci`;

-- AlterTable
ALTER TABLE `log_attivita` ADD COLUMN `societa_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `soci` ADD COLUMN `utente_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `utenti` ADD COLUMN `cognome` VARCHAR(100) NULL,
    ADD COLUMN `is_super_admin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `nome` VARCHAR(100) NULL;

-- CreateTable
CREATE TABLE `utenti_azienda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `utente_id` INTEGER NOT NULL,
    `societa_id` INTEGER NOT NULL,
    `ruolo` ENUM('ADMIN', 'STANDARD', 'COMMERCIALISTA') NOT NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `ultimo_accesso` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `utenti_azienda_utente_id_idx`(`utente_id`),
    INDEX `utenti_azienda_societa_id_idx`(`societa_id`),
    UNIQUE INDEX `utenti_azienda_utente_id_societa_id_key`(`utente_id`, `societa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `note_azienda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `utente_azienda_id` INTEGER NOT NULL,
    `testo` TEXT NOT NULL,
    `colore` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `note_azienda_utente_azienda_id_idx`(`utente_azienda_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scadenze_azienda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `created_by_utente_id` INTEGER NOT NULL,
    `descrizione` VARCHAR(500) NOT NULL,
    `data_scadenza` DATE NOT NULL,
    `completata` BOOLEAN NOT NULL DEFAULT false,
    `data_completamento` DATETIME(3) NULL,
    `tipo_scadenza` ENUM('FISCALE', 'CONTABILE', 'GENERICA') NOT NULL,
    `priorita` ENUM('ALTA', 'MEDIA', 'BASSA') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scadenze_azienda_societa_id_data_scadenza_idx`(`societa_id`, `data_scadenza`),
    INDEX `scadenze_azienda_societa_id_completata_idx`(`societa_id`, `completata`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_azienda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `tipo` ENUM('SCADENZA_IMMINENTE', 'SCRITTURA_PROVVISORIA', 'IVA_DA_LIQUIDARE', 'BILANCIO_NON_QUADRA', 'GENERICO') NOT NULL,
    `messaggio` VARCHAR(500) NOT NULL,
    `livello` ENUM('INFO', 'WARNING', 'ERRORE') NOT NULL,
    `letto` BOOLEAN NOT NULL DEFAULT false,
    `link` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `alert_azienda_societa_id_letto_idx`(`societa_id`, `letto`),
    INDEX `alert_azienda_societa_id_created_at_idx`(`societa_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inviti_azienda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `ruolo` ENUM('ADMIN', 'STANDARD', 'COMMERCIALISTA') NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `scadenza` DATETIME(3) NOT NULL,
    `accettato` BOOLEAN NOT NULL DEFAULT false,
    `created_by_utente_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inviti_azienda_token_key`(`token`),
    UNIQUE INDEX `inviti_azienda_societa_id_email_key`(`societa_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `log_attivita_societa_id_timestamp_idx` ON `log_attivita`(`societa_id`, `timestamp`);

-- CreateIndex
CREATE UNIQUE INDEX `soci_societa_id_email_key` ON `soci`(`societa_id`, `email`);

-- AddForeignKey
ALTER TABLE `soci` ADD CONSTRAINT `soci_utente_id_fkey` FOREIGN KEY (`utente_id`) REFERENCES `utenti`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_attivita` ADD CONSTRAINT `log_attivita_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utenti_azienda` ADD CONSTRAINT `utenti_azienda_utente_id_fkey` FOREIGN KEY (`utente_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utenti_azienda` ADD CONSTRAINT `utenti_azienda_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `note_azienda` ADD CONSTRAINT `note_azienda_utente_azienda_id_fkey` FOREIGN KEY (`utente_azienda_id`) REFERENCES `utenti_azienda`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scadenze_azienda` ADD CONSTRAINT `scadenze_azienda_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scadenze_azienda` ADD CONSTRAINT `scadenze_azienda_created_by_utente_id_fkey` FOREIGN KEY (`created_by_utente_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_azienda` ADD CONSTRAINT `alert_azienda_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inviti_azienda` ADD CONSTRAINT `inviti_azienda_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inviti_azienda` ADD CONSTRAINT `inviti_azienda_created_by_utente_id_fkey` FOREIGN KEY (`created_by_utente_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
