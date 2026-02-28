import { Request, Response, NextFunction } from 'express';
import { validationResult, body, param, query } from 'express-validator';

/**
 * Middleware to validate request
 */
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.type === 'field' ? (err as any).path : 'unknown',
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * League creation validation
 */
export const validateLeagueCreation = [
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('League name must be 3-100 characters'),
  body('commissioner').trim().isLength({ min: 2, max: 50 }).withMessage('Commissioner name must be 2-50 characters'),
  body('season').isInt({ min: 2020, max: 2030 }).withMessage('Season must be between 2020-2030'),
  body('numOwners').optional().isInt({ min: 2, max: 20 }).withMessage('Number of owners must be 2-20'),
  body('budgetPerOwner').optional().isInt({ min: 100, max: 5000 }).withMessage('Budget must be 100-5000'),
  body('rosterSize').optional().isInt({ min: 10, max: 40 }).withMessage('Roster size must be 10-40'),
  body('owners').isArray({ min: 2 }).withMessage('Must have at least 2 owners'),
  body('owners.*').trim().isLength({ min: 2, max: 50 }).withMessage('Owner names must be 2-50 characters'),
  validate,
];

/**
 * Draft nomination validation
 */
export const validateNomination = [
  body('leagueId').isMongoId().withMessage('Invalid league ID'),
  body('playerId').isMongoId().withMessage('Invalid player ID'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('initialBid').isInt({ min: 1, max: 500 }).withMessage('Initial bid must be 1-500'),
  validate,
];

/**
 * Bid validation
 */
export const validateBid = [
  body('leagueId').isMongoId().withMessage('Invalid league ID'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('amount').isInt({ min: 1, max: 500 }).withMessage('Bid amount must be 1-500'),
  validate,
];

/**
 * Player update validation
 */
export const validatePlayerUpdate = [
  param('id').isMongoId().withMessage('Invalid player ID'),
  body('injuryStatus').optional().isIn(['Healthy', 'Day-to-Day', '7-Day IL', '15-Day IL', '60-Day IL', 'Out for Season']).withMessage('Invalid injury status'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be max 500 characters'),
  validate,
];

/**
 * Query parameter validation for players
 */
export const validatePlayerQuery = [
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be 1-500'),
  query('position').optional().isIn(['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'P', 'UT', '1B/3B', '2B/SS']).withMessage('Invalid position'),
  query('available').optional().isBoolean().withMessage('Available must be true/false'),
  query('search').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Search term must be 2-50 characters'),
  validate,
];

/**
 * MongoDB ID validation
 */
export const validateMongoId = (paramName: string = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
  validate,
];
