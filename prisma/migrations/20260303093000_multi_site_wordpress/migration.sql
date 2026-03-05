ALTER TABLE `WordPressCredential`
  ADD COLUMN `name` VARCHAR(191) NOT NULL DEFAULT 'Primary site',
  ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT true;

UPDATE `WordPressCredential`
SET
  `name` = CASE
    WHEN `baseUrl` IS NULL OR TRIM(`baseUrl`) = '' THEN 'Primary site'
    ELSE REPLACE(REPLACE(REPLACE(`baseUrl`, 'https://', ''), 'http://', ''), '/', '')
  END,
  `isDefault` = true
WHERE `name` = 'Primary site';

ALTER TABLE `WordPressCredential`
  ADD UNIQUE INDEX `WordPressCredential_userId_baseUrl_key`(`userId`, `baseUrl`),
  ADD INDEX `WordPressCredential_userId_isDefault_idx`(`userId`, `isDefault`);

ALTER TABLE `WordPressCredential`
  DROP INDEX `WordPressCredential_userId_key`;
