export function playSuccessSound() {
	try {
		const audio = new Audio('/success-sound.mp3');
		audio.volume = 0.5; // Set volume to 50%
		audio.play().catch(error => {
			console.log('Could not play success sound:', error);
		});
	} catch (error) {
		console.log('Audio not supported:', error);
	}
}
