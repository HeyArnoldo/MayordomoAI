import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caja } from './caja.entity';
import { CajasController } from './cajas.controller';
import { CajasService } from './cajas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Caja])],
  controllers: [CajasController],
  providers: [CajasService],
  exports: [CajasService],
})
export class CajasModule {}
