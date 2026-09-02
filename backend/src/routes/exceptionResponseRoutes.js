const Router = require('koa-router');
const ExceptionResponseController = require('../controllers/exceptionResponseController');
const auth = require('../middlewares/auth');

const { operationAudit } = require('../middlewares/operationAudit');
const router = new Router({ prefix: '/api/v1/admin/exception-responses' });

router.get('/', auth, ExceptionResponseController.list);
router.post('/', auth, operationAudit({
  domain: 'apiservice',
  operationType: 'CREATE',
  resourceType: 'exception_response',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name'],
}), ExceptionResponseController.create);
router.get('/:id', auth, ExceptionResponseController.getById);
router.patch('/:id', auth, operationAudit({
  domain: 'apiservice',
  operationType: 'UPDATE',
  resourceType: 'exception_response',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name'],
}), ExceptionResponseController.update);
router.delete('/:id', auth, operationAudit({
  domain: 'apiservice',
  operationType: 'DELETE',
  resourceType: 'exception_response',
  resourceId: (ctx) => ctx.params.id,
}), ExceptionResponseController.remove);

module.exports = router;
