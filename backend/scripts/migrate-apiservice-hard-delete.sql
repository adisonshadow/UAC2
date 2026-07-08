-- API 服务改为物理删除，移除 deleted 状态

DELETE FROM bizdata.api_service_permissions
WHERE api_service_id IN (SELECT id FROM bizdata.api_services WHERE status = 'deleted');

DELETE FROM bizdata.api_service_operations
WHERE api_service_id IN (SELECT id FROM bizdata.api_services WHERE status = 'deleted');

DELETE FROM bizdata.api_service_runs
WHERE api_service_id IN (SELECT id FROM bizdata.api_services WHERE status = 'deleted');

DELETE FROM bizdata.api_services WHERE status = 'deleted';

ALTER TABLE bizdata.api_services DROP CONSTRAINT IF EXISTS api_services_status_check;

ALTER TABLE bizdata.api_services
    ADD CONSTRAINT api_services_status_check
    CHECK (status IN ('draft', 'published', 'disabled'));
