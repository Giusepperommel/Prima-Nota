-- CreateTable
CREATE TABLE `veicoli` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cespite_id` INTEGER NOT NULL,
    `tipo_veicolo` ENUM('AUTOVETTURA', 'MOTOCICLO', 'CICLOMOTORE', 'AUTOCARRO') NOT NULL,
    `uso_veicolo` ENUM('PROMISCUO', 'STRUMENTALE_ESCLUSIVO', 'USO_DIPENDENTE', 'AGENTE_COMMERCIO') NOT NULL,
    `modalita_acquisto` ENUM('CONTANTI', 'FINANZIAMENTO') NOT NULL,
    `marca` VARCHAR(100) NOT NULL,
    `modello` VARCHAR(100) NOT NULL,
    `targa` VARCHAR(20) NOT NULL,
    `limite_fiscale` DECIMAL(10, 2) NOT NULL,
    `percentuale_deducibilita` DECIMAL(5, 2) NOT NULL,
    `percentuale_detraibilita_iva` DECIMAL(5, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `veicoli_cespite_id_key`(`cespite_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `finanziamenti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `veicolo_id` INTEGER NOT NULL,
    `importo_finanziato` DECIMAL(10, 2) NOT NULL,
    `anticipo` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `numero_rate` INTEGER NOT NULL,
    `importo_rata` DECIMAL(10, 2) NOT NULL,
    `tan` DECIMAL(5, 2) NULL,
    `data_prima_rata` DATE NOT NULL,
    `operazione_ricorrente_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `finanziamenti_veicolo_id_key`(`veicolo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cessioni_veicoli` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `veicolo_id` INTEGER NOT NULL,
    `data_cessione` DATE NOT NULL,
    `prezzo_vendita` DECIMAL(10, 2) NOT NULL,
    `valore_residuo_contabile` DECIMAL(10, 2) NOT NULL,
    `plusvalenza` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `plusvalenza_imponibile` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `minusvalenza` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `minusvalenza_deducibile` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cessioni_veicoli_veicolo_id_key`(`veicolo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `veicoli` ADD CONSTRAINT `veicoli_cespite_id_fkey` FOREIGN KEY (`cespite_id`) REFERENCES `cespiti`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finanziamenti` ADD CONSTRAINT `finanziamenti_veicolo_id_fkey` FOREIGN KEY (`veicolo_id`) REFERENCES `veicoli`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `finanziamenti` ADD CONSTRAINT `finanziamenti_operazione_ricorrente_id_fkey` FOREIGN KEY (`operazione_ricorrente_id`) REFERENCES `operazioni_ricorrenti`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cessioni_veicoli` ADD CONSTRAINT `cessioni_veicoli_veicolo_id_fkey` FOREIGN KEY (`veicolo_id`) REFERENCES `veicoli`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
