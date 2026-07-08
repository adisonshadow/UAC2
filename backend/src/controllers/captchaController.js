const config = require('../config');
const logger = require('../utils/logger');
const { Captcha } = require('../models');
const { Op } = require('sequelize');

class CaptchaController {
  // 生成验证码
  static async generate(ctx) {
    try {
      // 生成随机背景图和拼图
      // const bgUrl = 'https://example.com/captcha/bg.jpg'; // 这里需要替换为实际的背景图生成逻辑
      // const puzzleUrl = 'https://example.com/captcha/puzzle.jpg'; // 这里需要替换为实际的拼图生成逻辑
      // // 实际上 puzzleUrl 需要借助imageMagic生成
      
      // 生成随机目标位置
      const targetX = Math.floor(Math.random() * 200) + 50; // 50-250之间的随机数
      const targetY = Math.floor(Math.random() * 100) + 25; // 25-125之间的随机数
      
      // 计算过期时间
      const expiresAt = new Date(Date.now() + config.api.loginVerify.expiresIn * 1000);
      
      // 创建验证码记录
      const captcha = await Captcha.create({
        // bg_url: bgUrl,
        // puzzle_url: puzzleUrl,
        // 为了兼容旧的验证码，暂不删除 url
        bg_url: '-',
        puzzle_url: '-',
        target_x: targetX,
        target_y: targetY,
        expires_at: expiresAt,
        status: 'ACTIVE'
      });
      
      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: 'success',
        data: {
          captcha_id: captcha.captcha_id,
          // bg_url: captcha.bg_url,
          // puzzle_url: captcha.puzzle_url
        }
      };
    } catch (error) {
      logger.error('生成验证码失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '生成验证码失败',
        data: null
      };
    }
  }

  // 验证滑块位置
  static async verify(ctx) {
    try {
      const { captcha_id, duration, trail } = ctx.request.body;
      
      // 查找验证码记录
      const captcha = await Captcha.findOne({
        where: {
          captcha_id,
          status: 'ACTIVE',
          expires_at: {
            [Op.gt]: new Date()
          }
        }
      });
      
      if (!captcha) {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '验证码无效或已过期',
          data: {
            verified: false
          }
        };
        return;
      }

      // 验证轨迹
      const validateResult = CaptchaController.validateTrail(trail, duration);
      
      // 更新验证码状态
      await captcha.update({
        status: validateResult.isValid ? 'USED' : 'ACTIVE',
        verified_at: validateResult.isValid ? new Date() : null
      });
      
      if (validateResult.isValid) {
        ctx.status = 200;
        ctx.body = {
          code: 200,
          message: 'success',
          data: {
            verified: true,
            reason: validateResult.reason,
            details: validateResult.details
          }
        };
      } else {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '验证失败',
          data: {
            verified: false,
            reason: validateResult.reason,
            details: validateResult.details
          }
        };
      }
    } catch (error) {
      logger.error('验证失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '验证失败',
        data: null
      };
    }
  }

  // 验证轨迹
  static validateTrail(trail, duration) {
    if (!trail || trail.length < 10) {
      return {
        isValid: false,
        reason: '轨迹点数不足'
      };
    }

    // 检查时间戳
    const hasValidTimestamps = trail.some((point, index) => {
      if (index === 0) return true;
      return point.timestamp > trail[index - 1].timestamp;
    });

    if (!hasValidTimestamps) {
      return {
        isValid: false,
        reason: '轨迹时间戳异常'
      };
    }

    // 1. 轨迹分析
    const trajectoryResult = CaptchaController.analyzeTrajectory(trail);
    
    // 2. 速度变化分析
    const velocityResult = CaptchaController.analyzeVelocity(trail, duration);
    
    // 3. 坐标重复率分析
    const repetitionResult = CaptchaController.analyzeRepetition(trail);

    // 综合评分 - 调整权重
    const totalScore = trajectoryResult.score * 0.3 + velocityResult.score * 0.5 + repetitionResult.score * 0.2;
    
    // 降低阈值到0.5
    const isValid = totalScore > 0.5;

    return {
      isValid,
      reason: isValid ? '验证通过' : '综合评分不足',
      details: {
        trajectory: trajectoryResult,
        velocity: velocityResult,
        repetition: repetitionResult,
        totalScore
      }
    };
  }

  // 分析轨迹
  static analyzeTrajectory(trail) {
    let score = 1.0;
    let reason = [];
    
    // 计算轨迹的曲率
    let totalCurvature = 0;
    for (let i = 1; i < trail.length - 1; i++) {
      const prev = trail[i - 1];
      const curr = trail[i];
      const next = trail[i + 1];
      
      // 计算三点形成的角度
      const angle = CaptchaController.calculateAngle(prev, curr, next);
      totalCurvature += angle;
    }
    
    const avgCurvature = totalCurvature / (trail.length - 2);
    
    // 放宽曲率范围：0-45度
    if (avgCurvature < 0 || avgCurvature > 45) {
      score *= 0.5;
      reason.push(`轨迹曲率异常: ${avgCurvature.toFixed(2)}度`);
    }
    
    // 检查Y轴变化
    const yChanges = trail.map((point, i) => {
      if (i === 0) return 0;
      return Math.abs(point.y - trail[i - 1].y);
    });
    
    const avgYChange = yChanges.reduce((a, b) => a + b, 0) / yChanges.length;
    
    // 放宽Y轴变化范围：0.1-5像素
    if (avgYChange < 0.1 || avgYChange > 5) {
      score *= 0.5;
      reason.push(`Y轴变化异常: ${avgYChange.toFixed(2)}像素`);
    }
    
    return {
      score,
      reason: reason.length > 0 ? reason.join(', ') : '正常'
    };
  }

  // 分析速度变化
  static analyzeVelocity(trail) {
    let score = 1.0;
    let reason = [];

    // 检查时间戳是否都相同
    const allSameTimestamp = trail.every((point, index) => {
      if (index === 0) return true;
      return point.timestamp === trail[0].timestamp;
    });

    if (allSameTimestamp) {
      return {
        score: 0,
        reason: '所有点时间戳相同，无法进行速度分析'
      };
    }
    
    // 计算每个点之间的时间间隔和速度
    const velocities = [];
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const curr = trail[i];
      const timeDiff = curr.timestamp - prev.timestamp;
      
      if (timeDiff > 0) {
        const distance = Math.sqrt(
          Math.pow(curr.x - prev.x, 2) + 
          Math.pow(curr.y - prev.y, 2)
        );
        velocities.push(distance / timeDiff);
      }
    }
    
    // 计算速度变化率
    const velocityChanges = [];
    for (let i = 1; i < velocities.length; i++) {
      velocityChanges.push(Math.abs(velocities[i] - velocities[i - 1]));
    }
    
    const avgVelocityChange = velocityChanges.reduce((a, b) => a + b, 0) / velocityChanges.length;
    
    // 降低速度变化率要求
    if (avgVelocityChange < 0.05) {
      score *= 0.5;
      reason.push(`速度变化率过低: ${avgVelocityChange.toFixed(2)}`);
    }
    
    // 放宽加速减速判断条件
    const hasAcceleration = velocities.some((v, i) => i > 0 && v > velocities[i - 1] * 1.1);
    const hasDeceleration = velocities.some((v, i) => i > 0 && v < velocities[i - 1] * 0.9);
    
    if (!hasAcceleration || !hasDeceleration) {
      score *= 0.5;
      reason.push('缺少明显的加速或减速过程');
    }
    
    return {
      score,
      reason: reason.length > 0 ? reason.join(', ') : '正常'
    };
  }

  // 分析坐标重复率
  static analyzeRepetition(trail) {
    let score = 1.0;
    let reason = [];
    
    // 统计坐标点重复次数
    const pointCount = new Map();
    trail.forEach(point => {
      const key = `${Math.round(point.x)},${Math.round(point.y)}`;
      pointCount.set(key, (pointCount.get(key) || 0) + 1);
    });
    
    // 计算重复率
    const totalPoints = trail.length;
    const uniquePoints = pointCount.size;
    const repetitionRate = 1 - (uniquePoints / totalPoints);
    
    // 放宽重复率范围：0-10%
    if (repetitionRate < 0 || repetitionRate > 0.1) {
      score *= 0.5;
      reason.push(`坐标重复率异常: ${(repetitionRate * 100).toFixed(2)}%`);
    }
    
    return {
      score,
      reason: reason.length > 0 ? reason.join(', ') : '正常'
    };
  }

  // 计算三点形成的角度
  static calculateAngle(p1, p2, p3) {
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    const cos = dot / (mag1 * mag2);
    const angle = Math.acos(Math.min(Math.max(cos, -1), 1));
    
    return angle * (180 / Math.PI);
  }
}

module.exports = CaptchaController; 