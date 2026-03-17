-- DropForeignKey
ALTER TABLE `finanziamenti` DROP FOREIGN KEY `finanziamenti_operazione_ricorrente_id_fkey`;

-- DropForeignKey
ALTER TABLE `finanziamenti` DROP FOREIGN KEY `finanziamenti_veicolo_id_fkey`;

-- DropTable
DROP TABLE `finanziamenti`;
