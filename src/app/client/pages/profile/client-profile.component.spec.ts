import { TestBed } from '@angular/core/testing';
import { ClientProfileComponent } from './client-profile.component';

describe('ClientProfileComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientProfileComponent]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClientProfileComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
