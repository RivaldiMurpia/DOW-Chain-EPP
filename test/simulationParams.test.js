const simulationParams = require('../config/simulationParams');

describe('Simulation Parameters', () => {
    it('should have valid main pathway configuration', () => {
        expect(simulationParams.mainPathway.processingTimePerTransaction).toBeGreaterThan(0);
    });

    it('should have valid alternative pathways', () => {
        simulationParams.alternativePathways.forEach(pathway => {
            expect(pathway.processingTimePerTransaction).toBeGreaterThan(0);
            expect(pathway.congestionThreshold).toBeGreaterThan(0);
        });
    });

    it('should have valid transaction generation settings', () => {
        expect(simulationParams.transactionGeneration.probabilityPerTick).toBeGreaterThanOrEqual(0);
        expect(simulationParams.transactionGeneration.probabilityPerTick).toBeLessThanOrEqual(100);
    });
});