import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Manages the AI-driven onboarding state for each user.
 *
 * The `onboardingCompleted` flag (distinct from `onboardedAt` which records the
 * phone-link step) tracks whether the user has finished the conversational
 * box-setup flow guided by the agent. Until it is true, the agent runs in
 * onboarding-mode (guided box creation) instead of standard-mode.
 */
@Injectable()
export class OnboardingService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /**
   * Returns true when the user still needs to complete the AI onboarding flow.
   * Returns false for unknown users (safe default — no onboarding loop for ghosts).
   */
  async isOnboarding(userId: string): Promise<boolean> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return false;
    return !user.onboardingCompleted;
  }

  /**
   * Marks onboarding as complete. Idempotent: calling it on an already-completed
   * user is a no-op so the agent can safely call it without a precondition check.
   */
  async confirmOnboarding(userId: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return;
    if (user.onboardingCompleted) return; // already done — idempotent no-op
    await this.users.update(userId, { onboardingCompleted: true });
  }
}
