-- CreateTable
CREATE TABLE `provider_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `tipo` ENUM('FATTURE', 'BANCA') NOT NULL,
    `provider` ENUM('FILE', 'ARUBA', 'INFOCERT', 'FABRICK', 'NORDIGEN') NOT NULL,
    `credenziali` JSON NULL,
    `stato` ENUM('ATTIVO', 'CONFIGURAZIONE', 'ERRORE') NOT NULL DEFAULT 'CONFIGURAZIONE',
    `ultimo_sync` DATETIME(3) NULL,
    `config_extra` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `provider_config_societa_id_tipo_idx`(`societa_id`, `tipo`),
    UNIQUE INDEX `provider_config_societa_id_tipo_provider_key`(`societa_id`, `tipo`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_suggestions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `tipo` ENUM('CLASSIFICAZIONE', 'ANOMALIA', 'RICONCILIAZIONE', 'NARRATIVA') NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `suggestion` JSON NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `stato` ENUM('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPLIED') NOT NULL DEFAULT 'PENDING',
    `motivazione` TEXT NULL,
    `tokens_usati` INTEGER NULL,
    `reviewed_by` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_suggestions_societa_id_stato_idx`(`societa_id`, `stato`),
    INDEX `ai_suggestions_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifiche` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `utente_destinatario_id` INTEGER NULL,
    `tipo` ENUM('SCADENZA', 'ANOMALIA', 'DOCUMENTO', 'SYNC', 'ADEMPIMENTO', 'AI_REVIEW') NOT NULL,
    `priorita` ENUM('CRITICA', 'ALTA', 'MEDIA', 'BASSA') NOT NULL,
    `titolo` VARCHAR(255) NOT NULL,
    `messaggio` TEXT NOT NULL,
    `entity_type` VARCHAR(50) NULL,
    `entity_id` INTEGER NULL,
    `canale` ENUM('IN_APP', 'EMAIL', 'PORTALE') NOT NULL,
    `stato` ENUM('NON_LETTA', 'LETTA', 'ARCHIVIATA') NOT NULL DEFAULT 'NON_LETTA',
    `scheduled_at` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notifiche_societa_id_stato_idx`(`societa_id`, `stato`),
    INDEX `notifiche_utente_destinatario_id_stato_idx`(`utente_destinatario_id`, `stato`),
    INDEX `notifiche_scheduled_at_idx`(`scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `preferenze_notifica` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `utente_id` INTEGER NOT NULL,
    `tipo_evento` VARCHAR(50) NOT NULL,
    `canale` VARCHAR(20) NOT NULL,
    `abilitato` BOOLEAN NOT NULL DEFAULT true,
    `digest_frequency` ENUM('IMMEDIATO', 'GIORNALIERO', 'SETTIMANALE') NOT NULL DEFAULT 'IMMEDIATO',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `preferenze_notifica_utente_id_tipo_evento_canale_key`(`utente_id`, `tipo_evento`, `canale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `provider_config` ADD CONSTRAINT `provider_config_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_suggestions` ADD CONSTRAINT `ai_suggestions_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifiche` ADD CONSTRAINT `notifiche_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifiche` ADD CONSTRAINT `notifiche_utente_destinatario_id_fkey` FOREIGN KEY (`utente_destinatario_id`) REFERENCES `utenti`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `preferenze_notifica` ADD CONSTRAINT `preferenze_notifica_utente_id_fkey` FOREIGN KEY (`utente_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
