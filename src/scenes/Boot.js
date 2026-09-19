import Phaser from 'phaser';
import { generateTextures } from '../tiles.js';

export default class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    generateTextures(this);
  }
}
