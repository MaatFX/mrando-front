import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HikeMap } from './hike-map';

describe('HikeMap', () => {
  let component: HikeMap;
  let fixture: ComponentFixture<HikeMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HikeMap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HikeMap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
