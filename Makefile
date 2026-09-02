.PHONY: project test test-engine sim sweep rotation fixtures clean

# Generate the Xcode project (requires: brew install xcodegen)
project:
	xcodegen generate

# Run every package's tests. Works on any Mac with Xcode, no project needed.
test:
	cd Packages/RepEngine && swift test
	cd Packages/PushCore && swift test
	cd Packages/TrainingEngine && swift test

test-engine:
	cd Packages/RepEngine && swift test

# The Python reference implementation: accuracy report and noise sweep.
sim:
	cd Tools/RepEngineSim && python3 run.py

rotation:
	cd Tools/RepEngineSim && python3 run.py --rotation

sweep:
	cd Tools/RepEngineSim && python3 -c "import sys; sys.argv=['run.py']; import run; run.sweep(40)"

# Regenerate the fixtures the Swift tests replay.
fixtures:
	cd Tools/RepEngineSim && python3 run.py --export

clean:
	rm -rf Push.xcodeproj build DerivedData
