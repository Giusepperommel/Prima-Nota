-- CreateTable
CREATE TABLE `societa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ragione_sociale` VARCHAR(255) NOT NULL,
    `partita_iva` VARCHAR(11) NOT NULL,
    `codice_fiscale` VARCHAR(16) NOT NULL,
    `indirizzo` TEXT NULL,
    `regime_fiscale` VARCHAR(100) NULL,
    `data_costituzione` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `societa_partita_iva_key`(`partita_iva`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `soci` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `cognome` VARCHAR(100) NOT NULL,
    `codice_fiscale` VARCHAR(16) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `quota_percentuale` DECIMAL(5, 2) NOT NULL,
    `ruolo` ENUM('ADMIN', 'STANDARD') NOT NULL DEFAULT 'STANDARD',
    `data_ingresso` DATE NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `soci_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utenti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `socio_id` INTEGER NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `ultimo_accesso` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `utenti_socio_id_key`(`socio_id`),
    UNIQUE INDEX `utenti_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categorie_spesa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `percentuale_deducibilita` DECIMAL(5, 2) NOT NULL,
    `descrizione` TEXT NULL,
    `tipo_categoria` VARCHAR(50) NULL,
    `attiva` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operazioni` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `tipo_operazione` ENUM('FATTURA_ATTIVA', 'COSTO', 'SPESA', 'CESPITE') NOT NULL,
    `data_operazione` DATE NOT NULL,
    `numero_documento` VARCHAR(50) NULL,
    `descrizione` TEXT NOT NULL,
    `importo_totale` DECIMAL(10, 2) NOT NULL,
    `categoria_id` INTEGER NOT NULL,
    `importo_deducibile` DECIMAL(10, 2) NOT NULL,
    `percentuale_deducibilita` DECIMAL(5, 2) NOT NULL,
    `deducibilita_custom` BOOLEAN NOT NULL DEFAULT false,
    `tipo_ripartizione` ENUM('COMUNE', 'SINGOLO', 'CUSTOM') NOT NULL,
    `note` TEXT NULL,
    `file_allegato` VARCHAR(255) NULL,
    `file_xml` LONGTEXT NULL,
    `eliminato` BOOLEAN NOT NULL DEFAULT false,
    `created_by_user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `operazioni_societa_id_data_operazione_idx`(`societa_id`, `data_operazione`),
    INDEX `operazioni_categoria_id_idx`(`categoria_id`),
    INDEX `operazioni_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ripartizioni_operazione` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operazione_id` INTEGER NOT NULL,
    `socio_id` INTEGER NOT NULL,
    `percentuale` DECIMAL(5, 2) NOT NULL,
    `importo_calcolato` DECIMAL(10, 2) NOT NULL,

    INDEX `ripartizioni_operazione_operazione_id_idx`(`operazione_id`),
    INDEX `ripartizioni_operazione_socio_id_idx`(`socio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_attivita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `azione` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    `tabella` VARCHAR(50) NOT NULL,
    `record_id` INTEGER NOT NULL,
    `valori_prima` JSON NULL,
    `valori_dopo` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `log_attivita_user_id_idx`(`user_id`),
    INDEX `log_attivita_tabella_record_id_idx`(`tabella`, `record_id`),
    INDEX `log_attivita_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `soci` ADD CONSTRAINT `soci_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utenti` ADD CONSTRAINT `utenti_socio_id_fkey` FOREIGN KEY (`socio_id`) REFERENCES `soci`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categorie_spesa` ADD CONSTRAINT `categorie_spesa_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorie_spesa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ripartizioni_operazione` ADD CONSTRAINT `ripartizioni_operazione_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ripartizioni_operazione` ADD CONSTRAINT `ripartizioni_operazione_socio_id_fkey` FOREIGN KEY (`socio_id`) REFERENCES `soci`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_attivita` ADD CONSTRAINT `log_attivita_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
