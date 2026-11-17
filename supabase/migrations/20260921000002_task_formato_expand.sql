-- Novos formatos de arte (banner, capa, thumbnail, apresentação, carrossel)
ALTER TYPE task_formato ADD VALUE IF NOT EXISTS 'carrossel';
ALTER TYPE task_formato ADD VALUE IF NOT EXISTS 'banner';
ALTER TYPE task_formato ADD VALUE IF NOT EXISTS 'capa_site';
ALTER TYPE task_formato ADD VALUE IF NOT EXISTS 'capa_youtube';
ALTER TYPE task_formato ADD VALUE IF NOT EXISTS 'thumbnail';
ALTER TYPE task_formato ADD VALUE IF NOT EXISTS 'capa_facebook';
ALTER TYPE task_formato ADD VALUE IF NOT EXISTS 'apresentacao';
