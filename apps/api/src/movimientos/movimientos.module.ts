import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajasModule } from '../cajas/cajas.module';
import { Movimiento } from './movimiento.entity';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Movimiento]), CajasModule],
  controllers: [MovimientosController],
  providers: [MovimientosService],
  exports: [MovimientosService],
})
export class MovimientosModule {}
