const Router = require('koa-router');
const ExceptionResponseController = require('../controllers/exceptionResponseController');
const auth = require('../middlewares/auth');

const router = new Router({ prefix: '/api/v1/admin/exception-responses' });

router.get('/', auth, ExceptionResponseController.list);
router.post('/', auth, ExceptionResponseController.create);
router.get('/:id', auth, ExceptionResponseController.getById);
router.patch('/:id', auth, ExceptionResponseController.update);
router.delete('/:id', auth, ExceptionResponseController.remove);

module.exports = router;
