import { TestBed } from '@angular/core/testing';

import { Hike } from './hike';

describe('Hike', () => {
  let service: Hike;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Hike);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
