-- AlterTable
ALTER TABLE `soci` ADD COLUMN `socio_lavoratore` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `societa` ADD COLUMN `aliquota_irap` DECIMAL(5, 2) NOT NULL DEFAULT 3.90;
