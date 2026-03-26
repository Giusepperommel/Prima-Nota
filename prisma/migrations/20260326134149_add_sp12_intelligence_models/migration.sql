-- CreateTable
CREATE TABLE `regole_alert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NULL,
    `categoria` ENUM('SCADENZE', 'ANOMALIE_CONTABILI', 'CASH_FLOW', 'COMPLIANCE', 'CONFRONTO', 'RICONCILIAZIONE') NOT NULL,
    `codice` VARCHAR(50) NOT NULL,
    `descrizione` VARCHAR(255) NOT NULL,
    `soglia_valore` DOUBLE NULL,
    `soglia_giorni` INTEGER NULL,
    `gravita` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'WARNING',
    `attiva` BOOLEAN NOT NULL DEFAULT true,
    `canali` JSON NOT NULL,
    `ruoli_destinatari` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `regole_alert_categoria_attiva_idx`(`categoria`, `attiva`),
    UNIQUE INDEX `regole_alert_societa_id_codice_key`(`societa_id`, `codice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_generati` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `regola_id` INTEGER NOT NULL,
    `utente_destinatario_id` INTEGER NOT NULL,
    `tipo` ENUM('SCADENZE', 'ANOMALIE_CONTABILI', 'CASH_FLOW', 'COMPLIANCE', 'CONFRONTO', 'RICONCILIAZIONE') NOT NULL,
    `messaggio` TEXT NOT NULL,
    `gravita` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL,
    `dati_contesto` JSON NULL,
    `link_azione` VARCHAR(500) NULL,
    `stato` ENUM('NUOVO', 'VISTO', 'SNOOZED', 'RISOLTO') NOT NULL DEFAULT 'NUOVO',
    `snooze_fino_a` DATETIME(3) NULL,
    `risolto_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `alert_generati_societa_id_stato_idx`(`societa_id`, `stato`),
    INDEX `alert_generati_utente_destinatario_id_stato_idx`(`utente_destinatario_id`, `stato`),
    INDEX `alert_generati_regola_id_created_at_idx`(`regola_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `todo_generati` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `utente_id` INTEGER NOT NULL,
    `data` DATE NOT NULL,
    `titolo` VARCHAR(255) NOT NULL,
    `descrizione` TEXT NULL,
    `priorita` INTEGER NOT NULL DEFAULT 3,
    `link_azione` VARCHAR(500) NULL,
    `fonte` ENUM('SCADENZA', 'ANOMALIA', 'BOZZA', 'RICONCILIAZIONE', 'FATTURA', 'PORTALE', 'ALTRO') NOT NULL,
    `stato` ENUM('DA_FARE', 'IN_CORSO', 'COMPLETATA', 'SALTATA') NOT NULL DEFAULT 'DA_FARE',
    `completata_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `todo_generati_societa_id_utente_id_data_idx`(`societa_id`, `utente_id`, `data`),
    INDEX `todo_generati_stato_idx`(`stato`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `regole_alert` ADD CONSTRAINT `regole_alert_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_generati` ADD CONSTRAINT `alert_generati_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_generati` ADD CONSTRAINT `alert_generati_regola_id_fkey` FOREIGN KEY (`regola_id`) REFERENCES `regole_alert`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_generati` ADD CONSTRAINT `alert_generati_utente_destinatario_id_fkey` FOREIGN KEY (`utente_destinatario_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `todo_generati` ADD CONSTRAINT `todo_generati_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `todo_generati` ADD CONSTRAINT `todo_generati_utente_id_fkey` FOREIGN KEY (`utente_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
