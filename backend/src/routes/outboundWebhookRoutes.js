const Router = require('koa-router');
const OutboundWebhookController = require('../controllers/outboundWebhookController');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');

const router = new Router({ prefix: '/api/v1/admin/outbound-webhooks' });

router.get('/', authWithBuiltinApiGuard, OutboundWebhookController.list);
router.post('/', authWithBuiltinApiGuard, OutboundWebhookController.create);
router.get('/:id', authWithBuiltinApiGuard, OutboundWebhookController.getById);
router.patch('/:id', authWithBuiltinApiGuard, OutboundWebhookController.update);
router.delete('/:id', authWithBuiltinApiGuard, OutboundWebhookController.remove);
router.post('/:id/publish', authWithBuiltinApiGuard, OutboundWebhookController.publish);
router.post('/:id/disable', authWithBuiltinApiGuard, OutboundWebhookController.disable);
router.get('/:id/test-profile', authWithBuiltinApiGuard, OutboundWebhookController.getTestProfile);
router.post('/:id/test', authWithBuiltinApiGuard, OutboundWebhookController.test);
router.get('/:id/runs', authWithBuiltinApiGuard, OutboundWebhookController.listRuns);

module.exports = router;
