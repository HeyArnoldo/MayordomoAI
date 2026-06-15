import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveAccountGuard } from '../common/guards/active-account.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { OnboardingService } from './onboarding.service';

/**
 * Onboarding status and completion endpoints.
 *
 * POST /me/onboarding/ai-complete — sets onboardingCompleted = true.
 * Called by the web client after the agent finishes the guided box-setup
 * flow and the user confirms the budget. Also called internally by the
 * confirmOnboarding agent tool.
 */
@Controller('me')
@UseGuards(JwtAuthGuard, ActiveAccountGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /**
   * Marks AI onboarding as complete. Idempotent — safe to call multiple times.
   * The agent tool calls OnboardingService directly; this endpoint exists for
   * the web client to trigger completion (e.g., after polling detects 100% pct).
   */
  @Post('onboarding/ai-complete')
  @HttpCode(200)
  async complete(@CurrentUser() user: User): Promise<{ ok: true; onboardingCompleted: boolean }> {
    await this.onboarding.confirmOnboarding(user.id);
    return { ok: true, onboardingCompleted: true };
  }
}
