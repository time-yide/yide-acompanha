-- Bucket 'roteiros': o PDF do roteiro agora sobe direto do navegador (signed
-- upload URL). O tamanho/tipo informado pelo navegador não é confiável, então
-- o próprio Storage passa a recusar arquivo que não seja PDF ou maior que 10MB.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf']
where id = 'roteiros';
